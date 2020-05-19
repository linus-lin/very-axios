import axios from 'axios';

const ERROR_MESSAGE_MAPS = {
  'zh-cn': {
    DEFAULT: '接口请求失败',
    OFFLINE: '网络连接断开',
    400: '请求错误',
    401: '未授权，请确认是否登录',
    403: '无权限，禁止访问',
    404: '接口或资源不存在',
    405: '请求方式不允许',
    413: '资源过大',
    414: 'URI过长',
    500: '服务器内部错误',
    502: '网关错误',
    504: '网关超时',
  },
  en: {
    DEFAULT: 'Request Failed',
    OFFLINE: 'Network is Offline',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    413: 'Payload Too Large',
    414: 'URI Too Long',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    504: 'Gateway Timeout',
  },
};

export default class VeryAxios {
  constructor(
    {
      // whether or not show tips when error ocurrs
      tip = true,
      // how to show tips
      tipFn,
      errorHandlers = {
        // 支持 400/401/403/404/405/413/414/500/502/504
      },
      lang = 'zh-cn',
      loadingHandler = () => {},
      loadingCancelHanlder = () => {},
      getResponseStatus = (response) => response.errno,
      getResponseMessage = (response) => response.errmsg,
      getResponseData = (response) => response.data,
    } = {},
    axiosConfig,
  ) {
    // default axios config
    this.defaultAxiosConfig = {
      timeout: 20000,
      responseType: 'json',
      headers: {
        'content-type': 'application/json',
      },
    };

    this.tip = tip && tipFn && typeof tipFn === 'function';
    this.tipFn = tipFn;
    this.errorHandlers = errorHandlers;
    this.lang = lang;
    this.loadingHandler = loadingHandler;
    this.loadingCancelHanlder = loadingCancelHanlder;
    this.getResponseStatus = getResponseStatus;
    this.getResponseMessage = getResponseMessage;
    this.getResponseData = getResponseData;

    this.config = { ...this.defaultAxiosConfig, ...axiosConfig };

    this.createAxios();
    this.interceptors();
  }

  createAxios() {
    this.axios = axios.create(this.config);
  }

  interceptors() {
    // intercept response
    this.axios.interceptors.request.use((config) => {
      const loading = config.veryAxiosConfig && config.veryAxiosConfig.loading;
      if (loading && this.loadingHandler && typeof this.loadingHandler === 'function') this.loadingHandler();
      return config;
    });

    // intercept response
    this.axios.interceptors.response.use(
      // success handler
      // Any status code that lie within the range of 2xx cause this function to trigger
      (res) => {
        const { config } = res;
        const loading = config.veryAxiosConfig && config.veryAxiosConfig.loading;
        if (loading && this.loadingCancelHanlder && typeof this.loadingCancelHanlder === 'function') this.loadingCancelHanlder();
        return new Promise((resolve, reject) => {
          if (!res || !res.data) resolve();
          const resData = res.data;
          const status = this.getResponseStatus(resData);
          const message = this.getResponseMessage(resData) || ERROR_MESSAGE_MAPS[this.lang].DEFAULT;
          const data = this.getResponseData(resData);
          // status not equal to '0' means error
          if (String(status) !== '0') {
            if (this.tip) this.tipFn(message);
            const errorHandler = this.errorHandlers[status];
            if (errorHandler && typeof errorHandlers === 'function') errorHandler();
            reject(message);
          }
          return resolve(data);
        });
      },
      // error handler
      // Any status codes that falls outside the range of 2xx cause this function to trigger
      (error) => {
        const { config } = error;
        const loading = config.veryAxiosConfig && config.veryAxiosConfig.loading;

        if (loading && this.loadingCancelHanlder && typeof this.loadingCancelHanlder === 'function') this.loadingCancelHanlder();
        const errmsgMaps = ERROR_MESSAGE_MAPS[this.lang];
        let errmsg = errmsgMaps.DEFAULT;
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          const { status } = error.response;
          if (!window.navigator.onLine) errmsg = errmsgMaps.OFFLINE;
          else errmsg = errmsgMaps[status] || error.message;
          // run relative error handler
          const errorHandler = this.errorHandlers[status];
          if (errorHandler && typeof errorHandlers === 'function') errorHandler();
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          // return value is a error instance
          errmsg = error.message;
        } else {
          // Something happened in setting up the request that triggered an Error
          errmsg = error.message;
        }

        if (this.tip) this.tipFn(errmsg);
      },
    );
  }

  /**
   *
   * @param {String} type   [请求类型]
   * @param {String} path   [请求地址]
   * @param {Object} param  [附带参数]
   */
  fetch(type, path, param = {}, config = {}) {
    return new Promise((resolve, reject) => {
      this.axios[type](path, param, config)
        .then((response) => resolve(response))
        .catch((err) => reject(err));
    });
  }

  /**
   *
   * @param {String} path   [请求地址]
   * @param {Object} param  [附带参数]
   */
  GET(path, param = {}, options = { }) {
    return this.fetch('get', path, { params: param, veryAxiosConfig: options });
  }

  /**
   *
   * @param {String} path   [请求地址]
   * @param {Object} param  [附带参数]
   */
  POST(path, param = {}, options = { }) {
    return this.fetch('post', path, param, options);
  }

  /**
   *
   * @param {String} path   [请求地址]
   * @param {Object} param  [附带参数]
   */
  PUT(path, param = {}, options = { }) {
    return this.fetch('put', path, param, options);
  }

  /**
   *
   * @param {String} path   [请求地址]
   * @param {Object} param  [附带参数]
   */
  DELETE(path, param = {}, options = { }) {
    return this.fetch('delete', path, param, options);
  }

  /**
   * 上传表单方法
   * @param {*} path
   * @param {*} formdata
   */
  FORMDATA(path, formdata) {
    return new Promise((resolve, reject) => {
      this.axios(path, {
        method: 'post',
        data: formdata,
        headers: {
          'content-type': 'multipart/form-data;charset=UTF-8',
        },
      }).then((response) => resolve(response)).catch((err) => reject(err));
    });
  }
}