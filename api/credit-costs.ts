import { getDb, json } from './_lib/db.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const sql = getDb();
    
    // Get credit costs from admin config, with fallback to defaults
    const configRow = await sql`
      SELECT config_value FROM admin_config WHERE config_key = 'credit_costs' LIMIT 1`;
    
    let costs = {
      ai_message: 2,
      chart_generation: 1, 
      matching: 3
    };
    
    if (configRow[0] && configRow[0].config_value) {
      try {
        const parsed = JSON.parse(configRow[0].config_value as string);
        if (parsed && typeof parsed === 'object') {
          costs = {
            ai_message: parsed.ai_message ?? costs.ai_message,
            chart_generation: parsed.chart_generation ?? costs.chart_generation,
            matching: parsed.matching ?? costs.matching
          };
        }
      } catch (e) {
        // Use defaults if parsing fails
        console.error('[credit-costs] Failed to parse config:', e);
      }
    }
    
    return json(costs);
  } catch (e) {
    console.error('[credit-costs]', e);
    // Return defaults if database fails
    const costs = {
      ai_message: 2,
      chart_generation: 1, 
      matching: 3
    };
    return json(costs);
  }
}
