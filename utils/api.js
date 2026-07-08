const axios = require('axios');

const API = axios.create({
  baseURL: process.env.API_URL,
  headers: {
    'x-api-key': 'MELEYS',
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
};
