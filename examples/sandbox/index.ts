import { Snapflow } from "@snapflow/sdk";

const snapflow = new Snapflow({
  apiUrl: "http://localhost:8081/api",
  apiKey:
    "snapflow_c4e87afcd282313e4bcf2d6c263c6e1a7b69e7a3166ea82355fd331cf9069edc",
});

const typeScriptCode = `
const startTime = Date.now();
const duration = 10 * 60 * 1000; // 10 minutes in milliseconds
let minuteCounter = 1;

console.log("Starting 10-minute TypeScript execution...");

const interval = setInterval(() => {
  const elapsedTime = Date.now() - startTime;
  const minutesElapsed = Math.floor(elapsedTime / (60 * 1000));
  
  console.log(\`Minute \${minuteCounter}: TypeScript code is running (\${minutesElapsed} minutes elapsed)\`);
  console.log(\`Current time: \${new Date().toISOString()}\`);
  
  // Perform some computation to keep it active
  const randomNumber = Math.floor(Math.random() * 1000);
  const fibonacci = (n: number): number => {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
  };
  
  const fibResult = fibonacci(Math.min(randomNumber % 20, 15)); // Keep it reasonable
  console.log(\`Generated random number: \${randomNumber}, Fibonacci result: \${fibResult}\`);
  
  minuteCounter++;
  
  if (elapsedTime >= duration) {
    clearInterval(interval);
    console.log("✅ 10 minutes completed successfully!");
    console.log(\`Total execution time: \${Math.floor(elapsedTime / 1000)} seconds\`);
    process.exit(0);
  }
}, 60 * 1000); // Run every minute
`;

async function runTypeScriptInSandbox() {
  try {
    console.log("Creating sandbox...");
    const sandbox = await snapflow.create();
    
    console.log("Running TypeScript code in sandbox for 10 minutes...");
    const response = await sandbox.process.codeRun(typeScriptCode);
    
    console.log("Sandbox execution result:");
    console.log(response.result);
    
    console.log("Cleaning up sandbox...");
    await sandbox.delete();
    console.log("Sandbox destroyed successfully");
    
  } catch (error) {
    console.error("Error running TypeScript in sandbox:", error);
    process.exit(1);
  }
}

runTypeScriptInSandbox();
