-- Development Seed Data
-- WARNING: DO NOT USE IN PRODUCTION!

\echo 'Seeding development data...'

-- Insert development API keys
INSERT INTO api_keys (key, name, is_active) VALUES 
  ('dev-key-local-testing-only-12345678', 'Development Local Key', true),
  ('test-key-automated-tests-87654321', 'Test Suite Key', true),
  ('demo-key-for-demonstrations-11111', 'Demo Key', true)
ON CONFLICT (key) DO NOTHING;

\echo 'Development API keys created:';
\echo '  - dev-key-local-testing-only-12345678 (for local development)';
\echo '  - test-key-automated-tests-87654321 (for automated tests)';
\echo '  - demo-key-for-demonstrations-11111 (for demos)';
\echo '';
\echo 'Add to frontend/.env.local:';
\echo 'VITE_API_KEY=dev-key-local-testing-only-12345678';
\echo '';
\echo 'Seed data loaded successfully!';
