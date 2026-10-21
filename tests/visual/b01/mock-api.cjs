// Isolated B01 browser fixture. Never import this from the application.
const http = require('node:http')
const server = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:3101')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Content-Type', 'application/json')
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
  const success = request.url === '/api/auth/forgot-password' || request.url === '/api/auth/reset-password'
  response.writeHead(success ? 200 : 401)
  response.end(JSON.stringify(success
    ? { statusCode: 200, data: { message: 'If the account exists, the request was accepted' }, timestamp: new Date().toISOString() }
    : { statusCode: 401, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }))
})
server.listen(3102, '127.0.0.1', () => process.stdout.write('B01 fixture API: localhost:3102\n'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close())
