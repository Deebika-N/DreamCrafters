const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
  try {
    // 1. Create active Admin User
    const admin = await prisma.user.upsert({
      where: { email: 'athiv1118@gmail.com' },
      update: {},
      create: {
        name: 'cookie',
        email: 'athiv1118@gmail.com',
        passwordHash: 'dummyhash',
        role: 'admin',
        isVerified: true,
        isActive: true,
      },
    });

    // 2. Create active Student User
    const student = await prisma.user.upsert({
      where: { email: '23n208@psgtech.ac.in' },
      update: {},
      create: {
        name: 'athi',
        email: '23n208@psgtech.ac.in',
        passwordHash: 'dummyhash',
        role: 'student',
        isVerified: true,
        isActive: true,
      },
    });

    // 3. Create a Category for Content
    const category = await prisma.category.upsert({
      where: { id: 1 },
      update: { name: 'Technology Category for Testing' },
      create: {
        name: 'Technology Category for Testing',
        description: 'Mock category for Bruno tests',
      },
    });

    // 4. Generate Tokens
    const adminToken = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const studentToken = jwt.sign({ id: student.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    // 5. Read existing dummy.bru file and update
    const envPath = path.resolve(__dirname, '../bruno-collection/environments/dummy.bru');
    let envContent = fs.readFileSync(envPath, 'utf8');

    envContent = envContent.replace(/adminToken:.*$/m, `adminToken: ${adminToken}`);
    envContent = envContent.replace(/studentToken:.*$/m, `studentToken: ${studentToken}`);
    envContent = envContent.replace(/categoryId:.*$/m, `categoryId: ${category.id}`);

    fs.writeFileSync(envPath, envContent);

    console.log(`Successfully populated environment variables for Bruno! AdminID: ${admin.id}, StudentID: ${student.id}, CategoryID: ${category.id}`);
  } catch (error) {
    console.error('Error in setup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
