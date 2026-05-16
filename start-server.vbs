Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\my-ai-project\fanjuxingqiu-crow\project\backend"
WshShell.Run "node src\app.js", 0, False
