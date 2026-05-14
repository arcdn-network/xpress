const mongoose = require('mongoose');

const clientsDb = mongoose.connection.useDb('yape');
const clientsCollection = clientsDb.collection('clients');

async function findClientByEmail(email) {
  return clientsCollection.findOne({
    email: email.toLowerCase(),
  });
}

async function updateClientById(id, data) {
  return clientsCollection.updateOne({ _id: id }, { $set: data });
}

module.exports = {
  findClientByEmail,
  updateClientById,
};
