const axios = require('axios');

const API = axios.create({
  baseURL: process.env.API_URL,
  headers: {
    'x-api-key': 'MELEYS',
  },
});

const getUser = (id) => API.get(`/read_telegram_user/${id}`).then((r) => r.data);
const getHistory = (id, page = 1) => API.get(`/get_historial_page/${id}?page=${page}`).then((r) => r.data);
const createUser = (body) => API.post(`/create_telegram_user`, body).then((r) => r.data);
const updateUser = (id, body) => API.put(`/update_telegram_user_by_telegramId/${id}`, body).then((r) => r.data);
const createCreditLog = (body) => API.post(`/create_credit_logs`, body).then((r) => r.data);
const createActivacionLog = (body) => API.post(`/create_activacion_logs`, body).then((r) => r.data);

const getYapeClient = (email) => API.get(`/get_yape_client/${email}`).then((r) => r.data);
const updateYapeClient = (id, body) => API.put(`/update_yape_client/${id}`, body).then((r) => r.data);
const searchReseller = (id) => API.get(`/searchReseller/${id}`).then((r) => r.data);

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
};
