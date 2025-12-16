import React, { useEffect, useState } from 'react'
import { Card,Button, Container } from "react-bootstrap";
import './Examstart.css'
import "./ExamSection.css";
import Toast from 'react-bootstrap/Toast';
import { useNavigate } from 'react-router-dom';

import axios from 'axios';

const ExamStart = () => {
    const navigate=useNavigate();
    const [correctanswers,setcorrectanswers]=useState(0);
   const [show, setShow] = useState(false);
  const [exam, setexam] = useState([]);
  const [answersChosen, setAnswersChosen] = useState([]);
  const [locked, setLocked] = useState([]);
  const [result, setResult] = useState([]);

 const examfinished = () => {
   return locked.length > 0 && locked.every(l => l === true);
};
const showtoast=()=>{
    if(examfinished()){
        setShow(true);  
    }
    else{
      alert("Complete Your Exam");
    }   
}


   
  
const chooseAnswer = (index, option) => {
  if (locked[index]) return;

  const updated = [...answersChosen];
  updated[index] = option;
  setAnswersChosen(updated);

};

 const reviewAnswer = (index) => {
   if (locked[index]) return; 
   const correct =
     answersChosen[index]?.toString().trim().toLowerCase() ===
     exam[index].solution?.toString().trim().toLowerCase();
  if(correct===true){
setcorrectanswers(prev=>prev+1);
  }

  const newResult = [...result];
  newResult[index] = correct;
  setResult(newResult);

  const newLocked = [...locked];
  newLocked[index] = true;
  setLocked(newLocked);
};


useEffect(()=>{
    const fetchdata=async()=>{
        try{
        const res=await axios.post("http://127.0.0.1:8000/questions",{})
        setexam(res.data)
    }catch(error){
        console.error(error);
    }}
    fetchdata();
    
},[]);

  useEffect(() => {
    if (exam.length > 0) {
      setAnswersChosen(Array(exam.length).fill(null));
      setLocked(Array(exam.length).fill(false));
      setResult(Array(exam.length).fill(null));
      setcorrectanswers(0);
    }
  }, [exam]);


  return (
  
<>

{(!exam&&exam.length===0)&&(
  <div>
    Loading exam...
  </div>
)}
<Container className="py-5">
      <h2 className="mb-4">Exam Started</h2>

{
    exam.map((part,index)=>(
        


         <Card className="shadow-sm cardexam" key={index}>
        <Card.Body>
          <div className="d-flex justify-content-between mb-3">
           
            <span>Question {index+1} / {exam.length}</span>
          </div>

          <h5 className="mb-3">
            {part.question}
          </h5>

          <ul className="list-group ">
            <li className={`list-group-item ${answersChosen[index]==="a"?"clicked":"notclicked"} `}  onClick={()=>!locked[index]&&chooseAnswer(index,"a")}> A) {part.a}     
  

  </li>  <li className={`list-group-item ${answersChosen[index]==="b"?"clicked":"notclicked"} `}  onClick={()=>!locked[index]&&chooseAnswer(index,"b")}> B) {part.b}     
  

  </li>
          <li className={`list-group-item ${answersChosen[index]==="c"?"clicked":"notclicked"} `}  onClick={()=>!locked[index]&&chooseAnswer(index,"c")}> C) {part.c}     
  

  </li>
           <li className={`list-group-item ${answersChosen[index]==="d"?"clicked":"notclicked"} `}  onClick={()=>!locked[index]&&chooseAnswer(index,"d")}> D) {part.d}     
  

  </li>
          </ul>

          <button onClick={()=>reviewAnswer(index)} className='answerbutton'>Check Answer</button>
          {result[index]===true&&(
            <div className='answerdivc'>
                Correct Answer ✔
            </div>
          )}
           {result[index]===false&&(
            <div className='answerdivw'>
                Wrong Answer, The correct answer is {part.solution}
            </div>
          )}
       
        </Card.Body>
       
      </Card>

      

    ))



    
}

<Button variant="primary" onClick={showtoast}>Show Result</Button>

<Toast onClose={() => setShow(false)} show={show} delay={3000} autohide>
          <Toast.Header>
          
            <strong className="me-auto">Result</strong>
            
          </Toast.Header>
          <Toast.Body>Your Grade is {correctanswers}/{exam.length}</Toast.Body>
        </Toast>


  <Button variant="secondary" className='btns' onClick={()=>navigate("/lesson")}>Return to Session</Button>
    </Container>
</>
  )
}

export default ExamStart