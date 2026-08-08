const axios = require('axios');
const RENIEC_URL = 'https://api.azuraperu.app/servicios/reniec_free';
const RENIEC_TOKEN = '0CeQ9Cm0KXqIKiavpy9BpGX6joSJucFjPNqUit2q';

const API = axios.create({
  baseURL: process.env.API_URL,
  headers: {
    'x-api-key': 'MELEYS',
  },
});

const RENIEC_API = axios.create({
  baseURL: RENIEC_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Auth-Token': RENIEC_TOKEN,
  },
});

const getHistory = (id, page = 1) => API.get(`/get_historial_page/${id}?page=${page}`).then((r) => r.data);
const createUser = (body) => API.post(`/create_telegram_user`, body).then((r) => r.data);
const updateUser = (id, body) => API.put(`/update_telegram_user_by_telegramId/${id}`, body).then((r) => r.data);
const createCreditLog = (body) => API.post(`/create_credit_logs`, body).then((r) => r.data);
const createActivacionLog = (body) => API.post(`/create_activacion_logs`, body).then((r) => r.data);

const updateYapeClient = (id, body) => API.put(`/update_yape_client/${id}`, body).then((r) => r.data);
const searchReseller = (id) => API.get(`/searchReseller/${id}`).then((r) => r.data);
const createToken = (body) => API.post(`/create_token`, body).then((r) => r.data);

const getBroadcastUsers = () => API.get(`/get_broadcast_users`).then((r) => r.data);

const getUser = (id) =>
  API.get(`/read_telegram_user/${id}`)
    .then((r) => r.data)
    .catch((e) => {
      if (e.response?.status === 404) return null;
      throw e;
    });

const getYapeClient = (email, supplierId) =>
  API.get(`/get_yape_client/${email}`, { params: supplierId ? { supplier: supplierId } : {} })
    .then((r) => r.data)
    .catch((e) => {
      if (e.response?.status === 404) return null;
      throw e;
    });

const consultarNombrePorDNI = (dni) =>
  RENIEC_API.post('', { documento: dni })
    .then((r) => r.data)
    .then((data) => {
      if (data?.status !== 'success' || !data?.listaAni) return null;

      const { apellido_paterno, apellido_materno, nombres } = data.listaAni;

      return [apellido_paterno, apellido_materno, nombres].filter(Boolean).join(' ').toUpperCase();
    })
    .catch((e) => {
      console.error('[RENIEC] Error:', e.message);
      return null;
    });

module.exports = {
  getUser,
  getHistory,
  createUser,
  updateUser,
  createCreditLog,
  createActivacionLog,
  getYapeClient,
  updateYapeClient,
  searchReseller,
  createToken,
  getBroadcastUsers,
  consultarNombrePorDNI,
};
