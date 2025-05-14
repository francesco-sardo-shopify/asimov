import type { Config } from "@react-router/dev/config";

const isProduction = process.env.NODE_ENV === 'production';

export default {
  ssr: false,
  basename: isProduction ? "/asimov" : "/",
} satisfies Config;
