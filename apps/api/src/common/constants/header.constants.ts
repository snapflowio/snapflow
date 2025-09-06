export const CustomHeaders: {
  [key: string]: {
    name: string;
    description?: string;
    required?: boolean;
    schema?: {
      type?: string;
    };
  };
} = {
  SOURCE: {
    name: "X-Source",
    description: "Use to specify the source of the request",
    required: false,
    schema: {
      type: "string",
    },
  },
};
