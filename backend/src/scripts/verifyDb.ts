import { prisma } from '../config/database';

async function verifyConnection() {
  console.log('\n🔍 Testing database connectivity with Prisma...');
  try {
    const result = await prisma.$queryRaw<Array<{ connected: number }>>`SELECT 1 as connected`;
    console.log('✅ Successfully connected to PostgreSQL / Supabase!');
    
    // Inspect existing tables non-destructively
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;

    console.log(`📊 Found ${tables.length} existing tables in public schema:`);
    if (tables.length > 0) {
      tables.forEach(t => console.log(`   - ${t.table_name}`));
    }

    const userCols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'User' ORDER BY ordinal_position;
    `;
    console.log('👤 Columns in User table:', userCols.map(c => c.column_name));

    process.exit(0);
  } catch (error: unknown) {
    console.error('\n❌ Database connection failed!');
    if (error instanceof Error) {
      console.error(`Error message: ${error.message}`);
    }
    console.log('\n💡 Troubleshooting Tips:');
    console.log('1. Verify your DATABASE_URL and DIRECT_URL in backend/.env');
    console.log('2. If your Supabase password contains special characters (like @, #, $, %), encode them:');
    console.log('   "@" becomes "%40"');
    console.log('   "#" becomes "%23"');
    console.log('   "$" becomes "%24"');
    console.log('3. Ensure your Supabase project is active (not paused).');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyConnection();
