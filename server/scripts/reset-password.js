// Sets a new password for an account, for when nobody can sign in.
// Run from server/:  node scripts/reset-password.js
// It asks for the email and the new password, and uses MONGODB_URI from server/.env.
require('dotenv').config({ quiet: true });
const readline = require('readline');
const mongoose = require('mongoose');
const User = require('../models/User');

const ask = (rl, question) => new Promise((resolve) => rl.question(question, resolve));

(async () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const email = (await ask(rl, 'Email: ')).trim().toLowerCase();
    const password = await ask(rl, 'New password (6+ characters): ');
    if (password.length < 6) throw new Error('The password must be at least 6 characters.');

    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email });
    if (!user) throw new Error(`No account uses ${email} in database "${mongoose.connection.name}".`);

    user.password = password; // hashed by the model before saving
    await user.save();
    console.log(`Password changed for ${user.name} (${email}) in database "${mongoose.connection.name}".`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
})();
