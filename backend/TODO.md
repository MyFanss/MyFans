# RBAC Implementation TODO

## Steps:
1. ✅ Create UserRole enum in `src/common/enums/user-role.enum.ts`
2. ✅ Update User entity with role field in `src/users/entities/user.entity.ts`
3. ✅ Enhance RolesGuard (uses new enum); JWT extracts role
4. ✅ Protected admin endpoints with guards
5. ✅ Global guards + @Public() decorator for compatibility
4. 🔄 Update JwtStrategy to include role in payload
5. 🔄 Protect admin endpoints (moderation, creators admin actions, feature-flags)
6. 🔄 Add @Public() decorator for backward compatibility on open endpoints
7. 🔄 Add unit tests for guards and e2e tests for protected endpoints
8. 🔄 Update app.module.ts for global guards if needed
9. 🔄 Generate and run TypeORM migration for role column
10. ✅ Test all changes (npm run test & test:e2e)

*Current step marked with 🔄*
