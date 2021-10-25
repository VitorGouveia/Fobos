import { theme } from "./default"

export const light: typeof theme = {
  ...theme,

  title: "light",

  fonts: {
    ...theme.fonts,
  },

  sizes: {
    ...theme.sizes,
  },

  colors: {
    ...theme.colors,

    accent: {
      100: "#FD6868",
      200: "#FD4D4D",
      300: ""
    },

    gray: {
      50: "hsl(255, 1%, 98%)",
      100: "hsl(255, 6%, 90%)",
      200: "hsl(220, 6%, 80%)",
      300: "hsl(220, 6%, 70%)",
      400: "hsl(220, 6%, 60%)",
      500: "hsl(220, 6%, 50%)",
      600: "hsl(220, 6%, 40%)",
      700: "hsl(220, 6%, 30%)",
      800: "hsl(220, 6%, 20%)",
      900: "hsl(220, 6%, 9%)",
    }
  }
}