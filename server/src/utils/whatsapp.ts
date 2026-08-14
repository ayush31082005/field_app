import axios from 'axios';

const normalizeIndianMobile = (mobile: string) => String(mobile || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(-10);

export const sendWhatsAppOTP = async (mobile: string, otp: string, name?: string): Promise<any> => {
  try {
    const authKey = process.env.WA_AUTHKEY;
    const wid = process.env.WA_TEMPLATE_ID;
    const countryCode = process.env.WA_COUNTRY_CODE || '91';

    if (!authKey || !wid) {
      throw new Error('WhatsApp API configuration missing (WA_AUTHKEY or WA_TEMPLATE_ID)');
    }

    // Using the POST request method as defined in the documentation
    // Building the exact GET URL as requested by the provided snippet
    const url = `https://console.messageinbox.io/restapi/request.php?authkey=${authKey}&mobile=${mobile}&country_code=${countryCode}&wid=${wid}&var1=${otp}`;

    const response = await axios.get(url);

    console.log('WhatsApp API Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error sending WhatsApp OTP:', error?.message || error);
    throw error;
  }
};

export const sendWhatsAppRejection = async (mobile: string, applicantName: string, applicationNumber: string): Promise<any> => {
  const authKey = process.env.WA_AUTHKEY;
  const templateId = process.env.WA_REJECTION_TEMPLATE_ID;
  const countryCode = process.env.WA_COUNTRY_CODE || '91';
  const recipient = normalizeIndianMobile(mobile);
  if (!authKey || !templateId) throw new Error('WhatsApp rejection configuration missing (WA_AUTHKEY or WA_REJECTION_TEMPLATE_ID)');
  if (!/^\d{10}$/.test(recipient)) throw new Error('Applicant WhatsApp mobile number is invalid');

  console.log('WhatsApp rejection message:', {
    mobile: `${countryCode}${recipient}`,
    templateId,
    templateVariables: {
      var1: applicantName,
      var2: applicationNumber,
    },
  });

  const response = await axios.get('https://console.messageinbox.io/restapi/request.php', {
    params: { authkey: authKey, mobile: recipient, country_code: countryCode, wid: templateId, var1: applicantName, var2: applicationNumber },
    timeout: 15000,
  });
  console.log('WhatsApp rejection response:', response.data);
  return response.data;
};
