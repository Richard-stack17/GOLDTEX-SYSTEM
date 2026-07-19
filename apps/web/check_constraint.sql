SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'profiles_role_check';
