import { fireAndForgetAxios } from "../utils/fireAndForget.js";

export const postTask = async (name, data, schedule) => {
    fireAndForgetAxios('post', `https://socketio.avakado.ai/api/task`, { name, data, schedule });
}
export const deleteTask = async (name, id) => {
    fireAndForgetAxios('delete', `https://socketio.avakado.ai/api/task/?id=${id}&name=${name}`);
}
