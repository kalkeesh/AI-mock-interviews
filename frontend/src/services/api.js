const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error("Request failed");
    error.response = { status: response.status, data };
    throw error;
  }

  return { data, status: response.status };
}

const api = {
  get(path, options = {}) {
    return request(path, { method: "GET", ...options });
  },
  post(path, body, options = {}) {
    return request(path, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    });
  },
  upload(path, formData, options = {}) {
    return request(path, {
      method: "POST",
      body: formData,
      ...options,
    });
  },
};

export default api;
