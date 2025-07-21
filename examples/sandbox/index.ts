import {Snapflow} from "@snapflow/sdk"

const snapflow = new Snapflow({
	apiUrl: "http://localhost:3000/api",
	apiKey: "snapflow_de3d2a1948f7c7deb213abbffac1a4203f4ad8c39b6fc7086c1eceb6b015d604"
})

const sandbox = await snapflow.create({
	autoDeleteInterval: 500000,
	autoStopInterval: 5000000
});

const response = await sandbox.process.executeCommand("ls -la")

console.log(response.result);