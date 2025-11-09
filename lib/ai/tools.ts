import { tool } from "ai";
import { loadPyodide } from "pyodide";
import z from "zod";

const OUTPUT_HANDLERS = {
  matplotlib: `
      import io
      import base64
      from matplotlib import pyplot as plt
  
      # Clear any existing plots
      plt.clf()
      plt.close('all')
  
      # Switch to agg backend
      plt.switch_backend('agg')
  
      def setup_matplotlib_output():
          def custom_show():
              if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                  print("Warning: Plot size too large, reducing quality")
                  plt.gcf().set_dpi(100)
  
              png_buf = io.BytesIO()
              plt.savefig(png_buf, format='png')
              png_buf.seek(0)
              png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
              print(f'data:image/png;base64,{png_base64}')
              png_buf.close()
  
              plt.clf()
              plt.close('all')
  
          plt.show = custom_show
    `,
  basic: `
      # Basic output capture setup
    `,
};

function detectRequiredHandlers(code: string): string[] {
  const handlers: string[] = ["basic"];

  if (code.includes("matplotlib") || code.includes("plt.")) {
    handlers.push("matplotlib");
  }

  return handlers;
}

export const runCode = tool({
  description: "Execute Python code. SQL queries are not supported.",
  inputSchema: z.object({
    python_code: z.string(),
  }),
  execute: async ({ python_code }) => {
    const outputContent: string[] = [];

    try {
      const pyodide = await loadPyodide();

      pyodide.setStdout({
        batched: (output: string) => {
          outputContent.push(output);
        },
      });

      await pyodide.loadPackagesFromImports(python_code, {
        messageCallback: (message: string) => {
          outputContent.push(message);
        },
      });

      const requiredHandlers = detectRequiredHandlers(python_code);
      for (const handler of requiredHandlers) {
        if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
          await pyodide.runPythonAsync(
            OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS],
          );

          if (handler === "matplotlib") {
            await pyodide.runPythonAsync("setup_matplotlib_output()");
          }
        }
      }

      const result = await pyodide.runPythonAsync(python_code);
      outputContent.push("result: " + result);
    } catch (error) {
      outputContent.push("error: " + error);
    }

    return { outputContent };
  },
});
