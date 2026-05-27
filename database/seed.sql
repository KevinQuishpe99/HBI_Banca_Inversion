-- ============================================
-- DATOS INICIALES (SEED DATA) — referencia legacy
-- ============================================
-- Preferir: npm run db:seed (bcrypt vía database/seed-with-bcrypt.js)

-- Usuarios de ejemplo (MD5 solo para pruebas manuales antiguas; no usar en producción)
INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
('admin@sistema.com', md5('Admin123!'), 'Admin', 'Sistema', 'ADMIN'),
('comercial@sistema.com', md5('Comercial123!'), 'Usuario', 'Comercial', 'COMERCIAL'),
('tecnica@sistema.com', md5('Tecnica123!'), 'Usuario', 'Técnica', 'TECNICA'),
('financiera@sistema.com', md5('Financiera123!'), 'Usuario', 'Financiera', 'FINANCIERA'),
('legal@sistema.com', md5('Legal123!'), 'Usuario', 'Legal', 'LEGAL'),
('usuario@sistema.com', md5('Usuario123!'), 'Usuario', 'Normal', 'USER');
