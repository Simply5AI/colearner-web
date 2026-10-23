/** Development only: stands in for the presigned storage URL so the upload flow can be exercised. It keeps nothing. */
export async function PUT(request: Request) {
  if (process.env.NODE_ENV !== 'development') return new Response('Not found', { status: 404 })
  await request.arrayBuffer()
  return new Response(null, { status: 200 })
}
