-- Race-free employee number generation.
-- Before: api/employees.ts used SELECT COUNT(*) + 1, which races under concurrent
-- create requests and can collide on the UNIQUE employee_number index.
-- After:  api/employees.ts calls nextval('employee_number_seq') inside a txn.
CREATE SEQUENCE IF NOT EXISTS employee_number_seq START 1;
