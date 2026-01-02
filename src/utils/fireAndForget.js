import axios from "axios";

export const fireAndForgetAxios = (method, url, data = {}, config = {}) => {
    setImmediate(() => {
        Promise.resolve()
            .then(() => axios({ method, url, data, ...config }))
            .catch(error => { console.error("Fire-and-forget Axios error:", { message: error.message, url, method }); });
    });
};
