import { defineControlUiPlugin } from "openclaw/plugin-sdk/control-ui";
import { mountBoard } from "./board.js";
import "./control-ui.css";

export default defineControlUiPlugin({
  id: "whiteboard",
  activate(host) {
    return host.ui.registerWidget({
      id: "board",
      label: "Whiteboard",
      mount(container, context) {
        let identity = `${context.props.agentId ?? ""}\0${context.props.sessionKey}`;
        let board = context.props.agentId
          ? mountBoard(container, {
            host: context.host,
            agentId: context.props.agentId,
            sessionKey: context.props.sessionKey,
            canMutate: context.props.canMutate,
          })
          : { dispose: () => { container.replaceChildren(); } };
        if (!context.props.agentId) container.textContent = "Whiteboard needs a session agent ID.";
        const dispose = () => board.dispose();
        context.signal.addEventListener("abort", dispose, { once: true });
        return {
          update(next) {
            const nextIdentity = `${next.props.agentId ?? ""}\0${next.props.sessionKey}`;
            if (nextIdentity === identity && next.props.canMutate === context.props.canMutate) return;
            board.dispose();
            container.replaceChildren();
            identity = nextIdentity;
            context = next;
            board = next.props.agentId
              ? mountBoard(container, {
                host: next.host,
                agentId: next.props.agentId,
                sessionKey: next.props.sessionKey,
                canMutate: next.props.canMutate,
              })
              : { dispose: () => { container.replaceChildren(); } };
            if (!next.props.agentId) container.textContent = "Whiteboard needs a session agent ID.";
          },
          dispose,
        };
      },
    });
  },
});
