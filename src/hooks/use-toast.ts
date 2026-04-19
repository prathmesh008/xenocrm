import { toast } from "sonner"

export const useToast = () => {
  return {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast(message),
    warning: (message: string) => toast.warning(message),
    loading: (message: string) => toast.loading(message),
    promise: async <T>(
      promise: Promise<T>,
      {
        loading = "Loading...",
        success = "Success!",
        error = "Something went wrong.",
      }: {
        loading?: string
        success?: string | ((data: T) => string)
        error?: string | ((error: unknown) => string)
      } = {}
    ) => {
      return toast.promise(promise, {
        loading,
        success,
        error,
      })
    },
  }
}
