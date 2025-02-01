# SimpleAgent UI
## (OpenAI React Chat Fork)

This project is a fork of the fantastic [OpenAI React Chat Web Application](https://github.com/elebitzero/openai-react-chat) created by **elebitzero**. The original project provides a clean, customizable web frontend for the OpenAI Chat API, built with React, Tailwind CSS, and TypeScript.

I’m integrating this UI as part of **SimpleAgent**, a project that explores the latest agentic best practices. The goal is to experiment with multi-agent systems and AI workflows in an intuitive, familiar interface. This UI was a perfect fit due to its clean design and robust structure.

## 🚀 Features
- Modern web stack: **React**, **Tailwind CSS**, and **TypeScript**
- Customizable chat interface with multi-model support
- Designed for seamless integration with OpenAI APIs
- Integrated with **SimpleAgent**'s FastAPI backend for efficient multi-agent communication and advanced AI workflows

See [FEATURES.md](FEATURES.md) for more details.

## 🌐 Preview

![SimpleAgent UI Preview](https://github.com/user-attachments/assets/4140d46c-cff2-481b-b606-d2ce869209f3)

## ⚙️ Requirements
- [Node.JS](https://nodejs.dev/en/)
- [npm](https://www.npmjs.com/)
- [OpenAI API Account](https://openai.com/blog/openai-api)
  - **Note:** GPT-4 API access requires at least [one successful payment](https://help.openai.com/en/articles/7102672-how-can-i-access-gpt-4).

## 🚀 Setup
1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/simpleagent-ui.git
```

2. **Configure your API key:**
Copy `env.json` to `local.env.json` and replace `'your-api-key-here'` with your [OpenAI API Key](https://platform.openai.com/account/api-keys).

3. **Run the FastAPI Backend:**
Ensure the FastAPI server is running to handle API requests:
```bash
uvicorn main:app --reload
```

4. **Build & Run the web server:**
```bash
npm install
npm run start
```

5. **Access the application:**
Open [http://localhost:3000/](http://localhost:3000/) in your browser.

## 🧩 Integration with FastAPI
This UI is tightly integrated with another project using FastAPI.

Make sure the FastAPI server is running to enable full functionality.

## 🤝 Credits
- Original UI by **elebitzero** - [GitHub Repo](https://github.com/elebitzero/openai-react-chat)
- Adapted and integrated into **SimpleAgent** for advanced agentic system experimentation.

## 💡 Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License
This project is open-source, following the original license from **OpenAI React Chat**. See [LICENSE](LICENSE) for details.


