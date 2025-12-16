import React, { useState,useEffect } from 'react'
import Button from 'react-bootstrap/Button';
import { easeInOut,motion} from "framer-motion";
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const QuizFlashcards = () => {
  const navigate=useNavigate();
  const [showanswers,setshowanswers]=useState(0);

  const [questionnumber,setquestionnumber]=useState(0);
  const[quiz,setquiz]=useState([])
 
useEffect(() => {
    const fetchdata = async () => {
      try {
        const res = await axios.post("http://127.0.0.1:8000/flashcards", {});
        setquiz(res.data || "");
      
      } catch (error) {
        console.error("Failed to fetch quiz:", error);
      } 
    };

    fetchdata();
  }, []);


const getnextquestion = () => {
  if (questionnumber === quiz.length - 1) {
    alert("You finished all questions");
  } else {
    setquestionnumber(prev => prev + 1);
    setshowanswers(0); // reset flashcard state
  }
};
const getprevquestion=()=>{
  if(questionnumber===0){
    return;
  }else{
    setquestionnumber(prev=>prev-1);
  }
}
const rotation=()=>{

  if(showanswers===2){
    setshowanswers(0);
  }
  else{
    setshowanswers(prev=>prev+1);
  }
}
  
  return (
    <>
    <div className='root'>

    
    <motion.div className='quizheader' animate= {showanswers>0 ? { rotate: [0, 360, 0] } : { rotate: 0 }}
  transition={{
    duration: 1,
    ease: easeInOut
  }}
  onClick={rotation}
    key={showanswers}
  >
      <div className='div1'>
        <div className='icondq'><i className="bi bi-lightbulb iconq"></i> </div>
        <p className='div1pq'>QUESTION</p>
     

      </div>
      <div>
<h3 className='quizh3'>{quiz[questionnumber].question}</h3>

 <div className='btndiv'>
 <Button variant="secondary" className='showflashbtn prev'  onClick={(e) => {
    e.stopPropagation();
    getprevquestion();
  }}>Previous Question</Button>
<Button variant="secondary" className='showflashbtn next'  onClick={(e) => {
    e.stopPropagation();
    getnextquestion();
  }}>Next Question</Button>
 </div>

</div>

      
      
      {showanswers===1&&(
        <div className='bodyq'>


           <div className='div1' >
            <div>
              
            </div>
        <div className='icondq part2a'>✔ </div>
        <p className='div1pq part3'>Answer </p>

      </div>
      <p className='answerp'>{quiz[questionnumber].answer}</p>
      <br />




    <div className='div1'>
           
        <div className='icondq part2a blue'>✔ </div>
        <p className='div1pq part3'>WHY THIS IS CORRECT</p>

      </div>
      <p className='answerp'>{quiz[questionnumber].why_correct}</p>
      <br />
      </div>

)}

{showanswers===2&&(
  <>

 <div className='div1' >
           
        <div className='icondq part2a'><i className="bi bi-exclamation-triangle  icccc"></i></div>
        <p className='div1pq part3'>COMMON MISTAKES </p>

      </div>
      <p className='answerp'>{quiz[questionnumber].common_mistake}</p>
      <br />

    </>


   




        
      )}
      </motion.div>
        <Button variant="secondary" className='showflashbtn next return'  onClick={()=>navigate("/lesson")}>Return To Session</Button>
      </div>
      </>
  )
}

export default QuizFlashcards