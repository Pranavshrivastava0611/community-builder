# Next.js 15 Route Handler Type Fix

## Issue
TypeScript errors in dynamic route handlers due to incorrect type signatures.

### Error Message
```
Type '{ params: { name: string } }' is not assignable to type '{ params: Promise<{ name: string }> }'
```

## Root Cause
Next.js 15 changed the type signature for dynamic route parameters:

### Before (Next.js 14 and earlier)
```typescript
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
)
```

### After (Next.js 15+)
```typescript
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
)
```

## Why the Change?
Next.js 15 made params asynchronous to support:
- Better performance with streaming
- Parallel route resolution
- Improved server-side rendering

## Files Fixed

### ✅ Already Correct (Had Promise)
- `app/api/messages/history/[conversationId]/route.ts`
- `app/api/friends/status/[targetId]/route.ts`
- `app/api/friends/mutual/[targetId]/route.ts`
- `app/api/feed/[communityId]/route.ts`
- `app/api/feed/posts/[postId]/route.ts`
- `app/api/feed/comments/[postId]/route.ts`
- `app/api/feed/comment/[commentId]/route.ts`
- `app/api/chat/[communityId]/route.ts`

### ✅ Fixed (Added Promise)
1. `app/api/communities/[name]/route.ts`
2. `app/api/communities/id/[id]/route.ts`
3. `app/api/communities/id/[id]/holders/route.ts`
4. `app/api/communities/id/[id]/promote/route.ts`

## Pattern to Follow

### Correct Pattern
```typescript
export async function GET(
  req: Request,
  { params }: { params: Promise<{ paramName: string }> }
) {
  // Always await params
  const { paramName } = await params;
  
  // Use paramName
  console.log(paramName);
}
```

### Common Mistakes
```typescript
// ❌ Wrong: Missing Promise
{ params }: { params: { id: string } }

// ❌ Wrong: Not awaiting params
const { id } = params; // Error: params is a Promise

// ✅ Correct: Promise type + await
{ params }: { params: Promise<{ id: string }> }
const { id } = await params;
```

## All Dynamic Routes in Project

| Route | Parameter | Status |
|-------|-----------|--------|
| `/api/communities/[name]` | `name` | ✅ Fixed |
| `/api/communities/id/[id]` | `id` | ✅ Fixed |
| `/api/communities/id/[id]/holders` | `id` | ✅ Fixed |
| `/api/communities/id/[id]/promote` | `id` | ✅ Fixed |
| `/api/feed/[communityId]` | `communityId` | ✅ Already correct |
| `/api/feed/posts/[postId]` | `postId` | ✅ Already correct |
| `/api/feed/comments/[postId]` | `postId` | ✅ Already correct |
| `/api/feed/comment/[commentId]` | `commentId` | ✅ Already correct |
| `/api/friends/status/[targetId]` | `targetId` | ✅ Already correct |
| `/api/friends/mutual/[targetId]` | `targetId` | ✅ Already correct |
| `/api/messages/history/[conversationId]` | `conversationId` | ✅ Already correct |
| `/api/chat/[communityId]` | `communityId` | ✅ Already correct |

## Testing

### Verify Fix
1. Run TypeScript check:
   ```bash
   npm run build
   ```

2. Should see no type errors related to params

3. Test dynamic routes:
   ```bash
   # Test community by name
   GET /api/communities/test-community
   
   # Test community by ID
   GET /api/communities/id/123
   ```

## Migration Guide

If you add new dynamic routes, always use this pattern:

```typescript
// For single parameter
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}

// For multiple parameters (nested routes)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string; postId: string }> }
) {
  const { userId, postId } = await params;
  // ...
}
```

## Related Documentation

- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)

## Conclusion

All dynamic route handlers now use the correct Next.js 15 type signature with `Promise<>` for params. TypeScript errors are resolved and the application is fully compatible with Next.js 15+.
