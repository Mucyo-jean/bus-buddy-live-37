
-- roles
CREATE TYPE public.app_role AS ENUM ('admin','driver','passenger');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "self assign non admin role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role <> 'admin');

-- signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role, 'passenger'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- routes
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT SELECT ON public.routes TO anon;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes readable" ON public.routes FOR SELECT USING (true);
CREATE POLICY "routes admin write" ON public.routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.bus_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  stop_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, stop_order)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_stops TO authenticated;
GRANT SELECT ON public.bus_stops TO anon;
GRANT ALL ON public.bus_stops TO service_role;
ALTER TABLE public.bus_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stops readable" ON public.bus_stops FOR SELECT USING (true);
CREATE POLICY "stops admin write" ON public.bus_stops FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number TEXT NOT NULL UNIQUE,
  plate_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active',
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buses TO authenticated;
GRANT SELECT ON public.buses TO anon;
GRANT ALL ON public.buses TO service_role;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buses readable" ON public.buses FOR SELECT USING (true);
CREATE POLICY "buses admin write" ON public.buses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, bus_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_assignments TO authenticated;
GRANT ALL ON public.driver_assignments TO service_role;
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments readable" ON public.driver_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignments admin write" ON public.driver_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  mode TEXT NOT NULL DEFAULT 'gps',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT SELECT ON public.trips TO anon;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips readable" ON public.trips FOR SELECT USING (true);
CREATE POLICY "driver creates own trip" ON public.trips FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid() AND public.has_role(auth.uid(),'driver'));
CREATE POLICY "driver updates own trip" ON public.trips FOR UPDATE TO authenticated
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "trips admin write" ON public.trips FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.bus_locations (
  id BIGSERIAL PRIMARY KEY,
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_kmh DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bus_locations_bus_idx ON public.bus_locations (bus_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.bus_locations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.bus_locations_id_seq TO authenticated;
GRANT SELECT ON public.bus_locations TO anon;
GRANT ALL ON public.bus_locations TO service_role;
ALTER TABLE public.bus_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations readable" ON public.bus_locations FOR SELECT USING (true);
CREATE POLICY "driver inserts own location" ON public.bus_locations FOR INSERT TO authenticated
  WITH CHECK (
    latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.driver_id = auth.uid() AND t.bus_id = bus_locations.bus_id AND t.status = 'active')
  );

CREATE TABLE public.passenger_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES public.bus_stops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (passenger_id, bus_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passenger_destinations TO authenticated;
GRANT ALL ON public.passenger_destinations TO service_role;
ALTER TABLE public.passenger_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own destinations" ON public.passenger_destinations FOR ALL TO authenticated
  USING (passenger_id = auth.uid()) WITH CHECK (passenger_id = auth.uid());

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT ON public.announcements TO anon;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements readable" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "announcements admin write" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;

-- demo data
INSERT INTO public.routes (id, name, origin, destination, description) VALUES
 ('11111111-1111-1111-1111-111111111111','Route 1: Nyabugogo - Kimironko','Nyabugogo','Kimironko','Main city corridor via Downtown and Remera'),
 ('22222222-2222-2222-2222-222222222222','Route 2: Kicukiro - Nyabugogo','Kicukiro','Nyabugogo','Southern corridor');

INSERT INTO public.bus_stops (route_id, name, latitude, longitude, stop_order) VALUES
 ('11111111-1111-1111-1111-111111111111','Nyabugogo',-1.944,30.061,1),
 ('11111111-1111-1111-1111-111111111111','Downtown',-1.950,30.058,2),
 ('11111111-1111-1111-1111-111111111111','Remera',-1.956,30.112,3),
 ('11111111-1111-1111-1111-111111111111','Kimironko',-1.953,30.126,4),
 ('22222222-2222-2222-2222-222222222222','Kicukiro Centre',-1.985,30.100,1),
 ('22222222-2222-2222-2222-222222222222','Gikondo',-1.972,30.077,2),
 ('22222222-2222-2222-2222-222222222222','Downtown',-1.950,30.058,3),
 ('22222222-2222-2222-2222-222222222222','Nyabugogo',-1.944,30.061,4);

INSERT INTO public.buses (bus_number, plate_number, capacity, status, route_id) VALUES
 ('12','RAC 123 K',40,'active','11111111-1111-1111-1111-111111111111'),
 ('18','RAD 456 B',32,'active','11111111-1111-1111-1111-111111111111'),
 ('25','RAE 789 C',28,'active','22222222-2222-2222-2222-222222222222');

INSERT INTO public.announcements (title, message, severity) VALUES
 ('Welcome','Live bus tracking with voice stop announcements is now available.','info');
