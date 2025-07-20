import {Snapflow} from "@snapflow/sdk"

const snapflow = new Snapflow({
	apiUrl: "http://localhost:3000/api",
	apiKey: "snapflow_61fd28cc1cf330a560435a420f52532959eb5cd75f71d9406d517e2e8466870f"
})

const sandbox = await snapflow.create({
	language: 'typescript',
});

const response = await sandbox.process.codeRun(`
console.log("Hello World!")
`)

console.log(response.result);

await sandbox.delete()