![Serama](../serama.png)

# API-first development & COPE

## Overview

Traditional product design is channel and device centric. But users inhabit in a multi-channel, multi device world.

Channel and/or device centric product design results in duplicated effort and wasted engineering work. API-first development is focused on removing this technical debt through the separation of the data backend and the data consuming frontend.

COPE stands for Create Once, Publish Everywhere. It is about reducing editorial overhead by freeing content for use in multiple different contexts. Simply put, COPE seperates data from design, making your content reusable and future-proof for new devices or platforms.

Taking an API-first development approach enables COPE and brings several additional benefits -

1. Separation of Concerns
2. Scalability
3. Reduction of Language Barriers
4. Developer Liberation
5. Openness and Future Consumer Availability

### 1. Separation of Concerns

Completely separating your frontend and backend codebases allows for easier management. It reduces future technical debt by not interlacing backend templated code into frontend client views.

### 2. Scalability

Completely separating your frontend and backend codebases helps to simplify future scalability by enabling you to scale platform components independently of each other. It allows for the client and server to sit behind their own load balancers and in their own infrastructure, giving you the ability to scale on a micro-level which brings flexibility (for example your data could be stored centrally while your client is hosted in multiple geographical locations) and cost savings.

### 3. Reduction of Language Barriers

Your API should be a reflection of your business logic. Seperating it our gives you the capability of expanding into diffent channels and in support of different devices while utilising the same backend.

Your API acts as a universal language which any of your clients can interact with. Even as you expand, every team will be speaking and understanding the same language. The expectations are always the same: same successes, same errors. Better yet, everybody knows JSON and almost everyone is up to speed with REST, so the API is globally understood.

### 4. Developer Liberation

API-first development liberates developers. The only thing application developers need to know is the request/response sequences of each API endpoint and any potential error codes. The same goes for mobile developers, and any other type of developer for that matter.

### 5. Openness and Future Consumer Availability

API-first makes opening your API for public consumption simple. And as a client of our own API, as you add more functionality you will be in aposition to offer it to consumers without any additional overhead.