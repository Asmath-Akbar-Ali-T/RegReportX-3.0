const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 9090,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Login Status:', res.statusCode);
    console.log('Login Body:', data);
    
    if (res.statusCode === 200) {
      const token = JSON.parse(data).token;
      console.log('Token received, hitting /issues');
      
      const req2 = http.request({
        hostname: 'localhost',
        port: 9090,
        path: '/api/validation/issues',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          console.log('Issues status:', res2.statusCode);
          console.log('Issues body:', data2.substring(0, 500));
        });
      });
      req2.end();
    }
  });
});
req.write(JSON.stringify({username: 'Kishore', password: '1234@'})); 
req.end();
