const bcrypt = require('bcrypt');

// Generate hashed passwords for the default users
const generatePasswords = async () => {
  const password = 'password123'; // Default password for all users
  const saltRounds = 12;
  
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  console.log('Hashed password:', hashedPassword);
  
  // SQL to update users with real passwords
  console.log('\nSQL to update users:');
  console.log(`UPDATE users SET password = '${hashedPassword}' WHERE email IN ('billy@nxtmedical.us', 'ernest@nxtmedical.us', 'nash@nxtmedical.us', 'admin@nxtmedical.us');`);
};

generatePasswords().catch(console.error);