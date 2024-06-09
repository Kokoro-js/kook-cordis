import { PrometheusDriver } from "./driver";

const queryClient = new PrometheusDriver({
  endpoint: "http://localhost:8428",
});

export default queryClient;
