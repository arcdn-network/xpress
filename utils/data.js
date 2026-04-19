const timestamps = {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
};

const myResellerId = '67fe4a30309c353c24682129';
const myClientId = '686204952f3e159952e7d52d';
const emailTester = 'pycharm113@gmail.com';

const ERROR = {
  LOGIN_FAILED: {
    status: 400,
    msg: 'Ocurrió un error al intentar iniciar sesión.',
  },
  PIN_INVALID: {
    status: 400,
    msg: 'El PIN debe tener 6 caracteres numéricos.',
  },
  USER_INVALID: {
    status: 401,
    msg: 'Credenciales inválidas. Puede recuperar tu clave en la sección "Olvido o cambio de clave".',
  },
  USER_DESKTOP: {
    status: 401,
    msg: 'El acceso desde computadoras no está permitido.',
  },
  USER_DISABLED: {
    status: 403,
    msg: 'Tu usuario está desactivado. Contáctame para solucionarlo.',
  },
  SESSION_ACTIVE: {
    status: 403,
    msg: 'Tienes una conexión activa en otro lugar. Múltiples intentos fallidos pueden bloquear tu cuenta.',
  },
  USER_BANNED: {
    status: 423,
    msg: 'Tu usuario está baneado. Contáctame para revisarlo.',
  },
  USER_EXPIRED: {
    status: 403,
    msg: 'Tu prueba gratis ha expirado.',
  },
  FREE_LIMIT_EXCEEDED: {
    status: 429,
    msg: 'Has superado el límite de accesos gratis. Para poder acceder debes comprar un paquete.',
  },
  SERVER_ERROR: {
    status: 500,
    msg: 'Error en el servidor.',
  },
};

const sendError = (res, code, extra = {}) => {
  const e = ERROR[code] || ERROR.SERVER_ERROR;
  return res.status(e.status).json({ status: false, code, msg: e.msg, ...extra });
};

const DESKTOP_WHITELIST = ['antonipacayapacaya83@gmail.com', 'xzrzlxz@gmail.com'];
const POLICE_RESTRICTED_EMAILS = ['pierrtupayachiosorio@gmail.com'];

const isDesktopBlocked = (userAgent, email) => {
  const ua = String(userAgent || '');
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
  const isAllowedDesktop = DESKTOP_WHITELIST.includes(email);
  return !isMobile && !isAllowedDesktop;
};

const isPhoneNumberHidden = (email) => {
  return POLICE_RESTRICTED_EMAILS.includes(email?.toLowerCase());
};

module.exports = Object.freeze({
  timestamps,
  myResellerId,
  myClientId,
  emailTester,
  sendError,
  isDesktopBlocked,
  isPhoneNumberHidden,
  ERROR,
});
