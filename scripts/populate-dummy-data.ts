import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Dummy data generators
const clientTypes = ['Limited Company', 'Sole Trader', 'Partnership', 'LLP'] as const;
const vatStaggerGroups = [1, 2, 3] as const;
const vatSchemes = ['Standard', 'Flat Rate', 'Cash Accounting', 'Annual Accounting'] as const;

const generateYearEndDate = (index: number): string => {
  // Stagger year-end dates throughout the year
  const month = (index % 12) + 1;
  // Use correct last day of each month
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const day = daysInMonth[month - 1];
  return `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const generateEmail = (companyName: string): string => {
  const cleanName = companyName.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
  return `info@${cleanName}.co.uk`;
};

const generatePhone = (index: number): string => {
  // UK phone numbers: 01XXX XXXXXX or 02X XXXX XXXX
  const areaCode = index % 2 === 0 ? '0207' : '01234';
  const number = String(1000000 + (index * 123456) % 9000000);
  return `${areaCode} ${number.substring(0, 3)} ${number.substring(3)}`;
};

async function populateDummyData() {
  console.log('Fetching clients with missing data...');

  const { data: clients, error: fetchError } = await supabase
    .from('clients')
    .select('*')
    .order('company_name', { ascending: true });

  if (fetchError) {
    console.error('Error fetching clients:', fetchError);
    process.exit(1);
  }

  if (!clients || clients.length === 0) {
    console.log('No clients found in the database.');
    return;
  }

  console.log(`Found ${clients.length} clients. Checking for missing data...`);

  const updates = [];

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const missingFields = [];
    const updateData: any = {};

    // Check and populate display_name
    if (!client.display_name) {
      missingFields.push('display_name');
      updateData.display_name = client.company_name;
    }

    // Check and populate primary_email
    if (!client.primary_email) {
      missingFields.push('primary_email');
      updateData.primary_email = generateEmail(client.company_name);
    }

    // Check and populate phone
    if (!client.phone) {
      missingFields.push('phone');
      updateData.phone = generatePhone(i);
    }

    // Check and populate client_type
    if (!client.client_type) {
      missingFields.push('client_type');
      updateData.client_type = clientTypes[i % clientTypes.length];
    }

    // Check and populate year_end_date
    if (!client.year_end_date) {
      missingFields.push('year_end_date');
      updateData.year_end_date = generateYearEndDate(i);
    }

    // Check and populate vat_stagger_group (only if vat_registered is true)
    if (client.vat_registered && !client.vat_stagger_group) {
      missingFields.push('vat_stagger_group');
      updateData.vat_stagger_group = vatStaggerGroups[i % vatStaggerGroups.length];
    }

    // Check and populate vat_scheme (only if vat_registered is true)
    if (client.vat_registered && !client.vat_scheme) {
      missingFields.push('vat_scheme');
      updateData.vat_scheme = vatSchemes[i % vatSchemes.length];
    }

    if (missingFields.length > 0) {
      console.log(`\nClient: ${client.company_name}`);
      console.log(`  Missing fields: ${missingFields.join(', ')}`);
      console.log(`  Will populate:`, updateData);

      updates.push({
        id: client.id,
        data: updateData
      });
    }
  }

  if (updates.length === 0) {
    console.log('\n✓ All clients have complete data!');
    return;
  }

  console.log(`\n\nUpdating ${updates.length} clients with dummy data...`);

  // Update each client
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('clients')
      .update(update.data)
      .eq('id', update.id);

    if (updateError) {
      console.error(`Error updating client ${update.id}:`, updateError);
    } else {
      console.log(`✓ Updated client ${update.id}`);
    }
  }

  console.log('\n✓ Dummy data population complete!');
}

populateDummyData().catch(console.error);
