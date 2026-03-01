import { env } from "$env/dynamic/public";

const baseUrl = env.PUBLIC_URL ? env.PUBLIC_URL : "";

export default baseUrl;
