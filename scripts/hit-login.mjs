const res = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'lecturer@demo.ibbul.edu', password: 'LecturerDemo123!' }),
});
console.log('status', res.status);
console.log(await res.text());
