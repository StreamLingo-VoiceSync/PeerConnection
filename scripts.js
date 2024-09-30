const userName="bobby-"+Math.floor(Math.random()*100000)
const password="x";
document.querySelector('#user-name').innerHTML=userName;
// we can use https://localhoat:8181/ for connecting in our localHost
const socket=io.connect('https://192.168.55.105:8181/',{
    auth:{
        userName,password
    }
}) // we can keep wss instead of wss but it disables long pooling

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream; //a var to hold the local video stream
let remoteStream; //a var to hold the remote video stream
let peerConnection; //the peerConnection that the two clients use to talk
let didIOffer = false; // a variable such that we can figure out who is offerer and who is answerer.

let peerConfiguration = {
    iceServers:[
        {
            urls:[
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302'
            ]
        }
    ]
}

//when a client initiates a call
const call = async e=>{
    await fetchUserMedia();

    //peerConnection is all set with our STUN servers sent over
    await createPeerConnection();

    //create offer time
    try{
        console.log("Creating offer...")
        const offer = await peerConnection.createOffer();
        //console.log(offer);
        peerConnection.setLocalDescription(offer)
        didIOffer=true;
        socket.emit('newOffer',offer);//send offer to signaling Server
        
    }catch(err){
        console.log(err)
    }

}
const answerOffer = async(offerObj)=>{
    await fetchUserMedia();
    await createPeerConnection(offerObj);
    const answer=await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);//this is Client2 and client2 uses the answer as the localDescription 
    console.log(offerObj)
    console.log(answer);
    //console.log(peerConnection.signalingState) //should be have-local-pranswer because Client2 has set its local desc to it's answer (but it won't be) 
    //add the answer to the offerObj so the server knows which offer this is related to
    offerObj.answer=answer
    //emit the answer to the signaling server,so it can emit to the client1.
    //expect a response from the server with the already exsisting ICE Candidates
    const offerIceCandidates=await socket.emitWithAck('newAnswer',offerObj);
    offerIceCandidates.forEach(c=>{
        peerConnection.addIceCandidate(c);
        console.log("=====Added ICE candidiates =======")
    })
}

const addAnswer = async(offerObj)=>{
    //add is called in socketListners when an answerResponse is emitted.
    //at tis point, the offer and answer hav been exchanged
    await peerConnection.setRemoteDescription(offerObj.answer);
    //console.log(peerConnection.signalingState)
}




const fetchUserMedia = ()=>{
    return new Promise(async(resolve, reject)=>{
        try{
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                // audio: true,
            });
            localVideoEl.srcObject = stream;
            localStream = stream;    
            resolve();    
        }catch(err){
            console.log(err);
            reject()
        }
    })
}

const createPeerConnection = (offerObj)=>{
    return new Promise(async(resolve, reject)=>{
        //RTCPeerConnection is the thing that creates the connection
        //we can pass a config object, and that config object can contain stun servers
        //which will fetch us ICE candidates
        peerConnection = await new RTCPeerConnection(peerConfiguration)
        remoteStream=new MediaStream()
        remoteVideoEl.srcObject=remoteStream;




        localStream.getTracks().forEach(track=>{
            peerConnection.addTrack(track,localStream);
        })

        peerConnection.addEventListener("signalingstatechange",(event)=>{
            console.log(event);
            console.log(peerConnection.signalingState)
    })


        peerConnection.addEventListener('icecandidate',e=>{
            console.log('...... Ice Candidate.......');
            console.log(e)
            if(e.candidate){
            socket.emit('sendIceCandidateToSignalingServer',{
                iceCandidate:e.candidate,
                iceUserName:userName,
                didIOffer,
            
            })
        }
        })

        peerConnection.addEventListener('track',e=>{
            console.log("Got a track from the other peer!!")
            console.log(e)
            e.streams[0].getTracks().forEach(track=>{
                remoteStream.addTrack(track,remoteStream)
                console.log("added remote stream Track");
            })
        })
        if(offerObj){
            //this wont be true when called from call();
            //will be set true when we call from answerOffer
            //console.log(peerConnection.signalingState) //should be stable because no setDesc has been run yet 
            await peerConnection.setRemoteDescription(offerObj.offer);
            //console.log(peerConnection.signalingState) //should be have-remote-offer,because client2 has setRemoteDesc on the offer
        }   
        resolve();
    })
}

const addNewIceCandidate = iceCandidate=>{
    peerConnection.addIceCandidate(iceCandidate)
    console.log("======Added Ice Candidate======")
}









document.querySelector('#call').addEventListener('click',call)