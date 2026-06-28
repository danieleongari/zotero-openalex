import { config } from "../package.json";
import hooks from "./hooks";

class Addon {
  public data: {
    alive: boolean;
    initialized: boolean;
    config: typeof config;
    env: "development" | "production";
  };

  public hooks = hooks;

  constructor() {
    this.data = {
      alive: true,
      initialized: false,
      config,
      env: (__env__ || "production") as "development" | "production",
    };
  }
}

export default Addon;
