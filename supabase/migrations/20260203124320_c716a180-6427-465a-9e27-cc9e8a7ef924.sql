-- Create storage bucket for email assets (logo, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Public read access for email assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'email-assets');