import { useEffect, useReducer, useState } from "react";
import { useParams, useHistory } from "react-router-dom";
import io from "socket.io-client";
import Peer from "simple-peer";

import "./CallPage.scss";
import Messenger from "./../UI/Messenger/Messenger";
import Alert from "../UI/Alert/Alert";
import MeetingInfo from "../UI/MeetingInfo/MeetingInfo";
import CallPageFooter from "../UI/CallPageFooter/CallPageFooter";
import CallPageHeader from "../UI/CallPageHeader/CallPageHeader";
import MessageListReducer from "../../reducer/MessageListReducer";
import { getRequest, postRequest } from "./../../utils/apiRequest";
import { BASE_URL, SAVE_CALL_ID, GET_CALL_ID } from "../../utils/apiEndpoints";

let peer = null;
const socket = io.connect(BASE_URL, {
  transports: ["websocket", "polling", "flashsocket"],
});
const initialState = [];

const CallPage = () => {
  const history = useHistory();
  let { id } = useParams();

  let alertTimeout = null;
  const isAdmin = window.location.hash === "#init" ? true : false;
  const url = window.location.origin + window.location.pathname;

  const [messageList, messageListReducer] = useReducer(
    MessageListReducer,
    initialState
  );

  const [streamObj, setStreamObj] = useState();
  const [screenCastStream, setScreenCastStream] = useState();
  const [meetInfoPopup, setMeetInfoPopup] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [isMessenger, setIsMessenger] = useState(false);
  const [isAudio, setIsAudio] = useState(true);
  const [messageAlert, setMessageAlert] = useState({});

  useEffect(() => {
    if (isAdmin) {
      setMeetInfoPopup(true);
    }
    initWebRTC();
    socket.on("code", (data) => {
      peer.signal(data);
    });
  }, [isAdmin]);

  const getRecieverCode = async () => {
    console.log("Getting code from redis since I'm not admin");
    const response = await getRequest(`${BASE_URL}${GET_CALL_ID}/${id}`);
    // console.log({ data_from_redis: response.code });
    if (response.code) {
      // Make remote peer signalling offer to get signalling data of peer since initiator = false for peer
      peer.signal(response.code);
    }
  };

  const initWebRTC = () => {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        setStreamObj(stream);

        peer = new Peer({
          initiator: isAdmin,
          trickle: false,
          stream: stream,
        });

        if (!isAdmin) {
          getRecieverCode();
        }

        // Fired when the peer wants to send signaling data to the remote peer.
        // For admin i.e initiator = true it fires right away.For initatior: false peers, it fires when the remote offer is received.)
        // simply call peer.signal(data) on the remote peer
        peer.on("signal", async (data) => {
          // data is signaling data given by simple-peer
          console.log({ signalingData: data });
          if (isAdmin) {
            console.log("Admin is signalling");
            let payload = {
              id,
              signalData: data,
            };
            console.log({ payload });
            await postRequest(`${BASE_URL}${SAVE_CALL_ID}`, payload);
          } else {
            // Socket event
            socket.emit("code", data, (cbdata) => {
              console.log("code sent");
            });
          }
        });

        // Fired when the new peer connection and data channel are ready to use.
        peer.on("connect", () => {
          console.log("New Peer connected");
        });

        peer.on("data", (data) => {
          clearTimeout(alertTimeout);
          messageListReducer({
            type: "addMessage",
            payload: {
              user: "other",
              msg: data.toString(),
              time: Date.now(),
            },
          });
          setMessageAlert({
            alert: true,
            isPopup: true,
            payload: {
              user: "other",
              msg: data.toString(),
            },
          });

          alertTimeout = setTimeout(() => {
            setMessageAlert({
              ...messageAlert,
              isPopup: false,
              payload: {},
            });
          }, 10000);
        });

        // Received a remote video stream, which can be displayed in a video tag:
        peer.on("stream", (stream) => {
          let video = document.querySelector("video");
          console.log("Getting new peer's stream");

          if ("srcObject" in video) {
            video.srcObject = stream;
          } else {
            video.src = window.URL.createObjectURL(stream); // for older browsers
          }

          video.play();
        });
      })
      .catch((e) => console.log(e));
  };

  const sendMsg = (msg) => {
    console.log({ onclinet: msg });
    peer.send(msg);
    messageListReducer({
      type: "addMessage",
      payload: {
        user: "you",
        msg: msg,
        time: Date.now(),
      },
    });
  };

  const screenShare = () => {
    navigator.mediaDevices
      .getDisplayMedia({ cursor: true })
      .then((screenStream) => {
        peer.replaceTrack(
          streamObj.getVideoTracks()[0],
          screenStream.getVideoTracks()[0],
          streamObj
        );
        setScreenCastStream(screenStream);
        screenStream.getTracks()[0].onended = () => {
          peer.replaceTrack(
            screenStream.getVideoTracks()[0],
            streamObj.getVideoTracks()[0],
            streamObj
          );
        };
      });
    setIsPresenting(true);
  };

  const stopScreenShare = () => {
    screenCastStream.getVideoTracks().forEach((track) => {
      track.stop();
    });
    peer.replaceTrack(
      screenCastStream.getVideoTracks()[0],
      streamObj.getVideoTracks()[0],
      streamObj
    );
    setIsPresenting(false);
  };
  const toggleAudio = (value) => {
    streamObj.getAudioTracks()[0].enabled = value;
    setIsAudio(value);
  };

  const disconnectCall = () => {
    peer.destroy();
    history.push("/");
    window.location.reload();
  };

  return (
    <div className="callpage-container">
      <video className="video-container" src="" controls></video>

      <CallPageHeader
        isMessenger={isMessenger}
        setIsMessenger={setIsMessenger}
        messageAlert={messageAlert}
        setMessageAlert={setMessageAlert}
      />
      <CallPageFooter
        isPresenting={isPresenting}
        stopScreenShare={stopScreenShare}
        screenShare={screenShare}
        isAudio={isAudio}
        toggleAudio={toggleAudio}
        disconnectCall={disconnectCall}
      />

      {isAdmin && meetInfoPopup && (
        <MeetingInfo setMeetInfoPopup={setMeetInfoPopup} url={url} />
      )}
      {isMessenger ? (
        <Messenger
          setIsMessenger={setIsMessenger}
          sendMsg={sendMsg}
          messageList={messageList}
        />
      ) : (
        messageAlert.isPopup && <Alert messageAlert={messageAlert} />
      )}
    </div>
  );
};
export default CallPage;
