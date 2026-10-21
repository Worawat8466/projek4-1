import { getClinicSettings, saveClinicSettings } from '../../../src/server/settingsRepository.js';
import { databaseErrorResponse } from '../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function GET() {
  try { return Response.json({ settings: await getClinicSettings() }); }
  catch (error) { return databaseErrorResponse(error); }
}

export async function PUT(request) {
  try {
    const settings = await request.json();
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || !settings.paymentMethods) {
      return Response.json({ error: 'invalid_settings' }, { status: 400 });
    }
    if (!settings.paymentMethods.cash && !settings.paymentMethods.promptpay) {
      return Response.json({ error: 'payment_method_required' }, { status: 400 });
    }
    return Response.json({ settings: await saveClinicSettings(settings) });
  } catch (error) { return databaseErrorResponse(error); }
}