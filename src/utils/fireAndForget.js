import axios from "axios";

export const fireAndForgetAxios = (method, url, data = {}, config = {}) => {
    void axios({ method, url, data, ...config })
        .catch(error => {
            console.error("Fire-and-forget Axios error:", error.message);
        });
};
