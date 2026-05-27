import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)

// Superuser 자동 로그인
// - 토큰이 없거나 만료된 경우 재인증
export async function initAuth() {
  if (!pb.authStore.isValid) {
    await pb.collection('_superusers').authWithPassword(
      import.meta.env.VITE_PB_EMAIL,
      import.meta.env.VITE_PB_PASSWORD,
    )
  }
}

// API 호출 시 401 등 인증 에러 발생하면 재인증 후 재시도
export async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (status === 401 || status === 403) {
      await pb.collection('_superusers').authWithPassword(
        import.meta.env.VITE_PB_EMAIL,
        import.meta.env.VITE_PB_PASSWORD,
      )
      return await fn()
    }
    throw err
  }
}

export default pb
