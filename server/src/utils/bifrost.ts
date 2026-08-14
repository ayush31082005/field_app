import axios from 'axios';

// Creating an axios instance for Bifrost APIs
// Adjust the headers as required when you get the actual API documentation.
const bifrostApi = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Fetch PAN card enrichment details
 * @param pan The 10-character PAN number
 * @param token The Authorization token
 */
export const fetchPanDetails = async (pan: string, token: string) => {
  try {
    const payload = {
      PAN_Number: pan,
      Concent: "Y",
      Concent_Text: "We confirm and undertake that valid end-user consent has been obtained for fetching PAN DETAILS using PAN NUMBER, and that such consent remains active and unrevoked at the time of this request."
    };

    const response = await axios.post('https://bifrost.unifers.ai/enrich/pan/v5', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      }
    });
    return response.data;
  } catch (error: any) {
    console.error('Bifrost PAN API Error:', error?.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch UAN details
 * @param mobileNumber The Mobile number for UAN
 * @param token The Authorization token
 */
export const fetchUanDetails = async (mobileNumber: string, token: string) => {
  try {
    const payload = {
      Mobile_Number: mobileNumber,
      Concent: "Y",
      Concent_Text: "We confirm and undertake that valid end-user consent has been obtained for fetching UAN DETAILS using MOBILE NUMBER, and that such consent remains active and unrevoked at the time of this request."
    };

    const response = await axios.post('https://bifrost.unifers.ai/enrich/get-uan', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      }
    });
    return response.data;
  } catch (error: any) {
    console.error('Bifrost UAN API Error:', error?.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch CIBIL / Credit Report
 * @param pan The PAN number
 * @param mobile The mobile number
 * @param fullName The Full Name
 * @param token The Authorization token
 */
export const fetchCibilReport = async (pan: string, mobile: string, fullName: string, token: string) => {
  try {
    const payload = {
      Mobile_Number: mobile,
      PAN_Number: pan,
      Full_Name: fullName,
      Callback_Url: "https://www.waqtfinance.com/api/score-callback",
      Concent_Text: "We confirm and undertake that valid end-user consent has been obtained for fetching CIBIL REPORT using MOBILE NUMBER, and that such consent remains active and unrevoked at the time of this request.",
      Concent: "Y"
    };

    const response = await axios.post('https://bifrost.unifers.ai/enrich/get-cibil-report', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      }
    });
    return response.data;
  } catch (error: any) {
    console.error('Bifrost CIBIL API Error:', error?.response?.data || error.message);
    throw error;
  }
};
