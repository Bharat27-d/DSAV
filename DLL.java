public class DLL {
    Node head;
    Node tail;
    class Node{
        int data;
        Node next;
        Node prev;

        Node(int data){
            this.data=data;
            this.next=null;
            this.prev=null;
        }
    }

    public void addfirst(int data){
        Node newnode=new Node(data);
        if(head==null){
            head=tail=newnode;
            return;
        }

        newnode.next=head;
        head.prev=newnode;
        head=newnode;
        
    }

    public void addlast(int data){
        Node newnode=new Node(data);
        if(head==null){
            head=tail=newnode;
            return;
        }

        Node cur=head;
        while(cur.next!=null){
            cur=cur.next;
        }
        newnode.prev=cur;
        cur.next=newnode;
        tail=newnode;


    }

    public void printDLL(){
         if(head==null){
            System.out.println("NOO");
            return;
        }

        Node cur=head;
        while(cur!=null){
            System.out.print(cur.data+"<=>");
            cur=cur.next;
        }
        System.out.print("NULL");
        System.out.println("");


    }

    public void lastprintDLL(){
         if(head==null){
            System.out.println("NOO");
            return;
        }

        Node cur=tail;
        while(cur!=null){
            System.out.print(cur.data+"<=>");
            cur=cur.prev;
        }
        System.out.print("NULL");
        System.out.println("");


    }

    public void deletefirst(){
        if(head==null){
        System.out.print("N00");
        return;
    }

    if(head.next==null){
        head=tail=null;
        return;
    }

        head=head.next;
        System.out.println("head.prev:-"+head.prev.data);
        head.prev=null;
        
    }

    public void deletelast(){
        if(head==null){
        System.out.print("N00");
        return;
    }

    if(head.next==null){
        head=tail=null;
        return;
    }

    System.out.println(tail.data);
    System.out.println(tail.prev.data);
    System.out.println(tail.next);
    tail=tail.prev;
    tail.next=null;
        

    }

    public static void main(String[] args){
        DLL list=new DLL();
        list.addfirst(10);
        list.addfirst(20);
        list.addfirst(30);
        list.printDLL();
        list.addlast(100);
        list.addlast(200);
        list.addlast(300);
        list.printDLL();
        list.deletefirst();
        list.printDLL();
        list.deletelast();
        list.printDLL();
        list.lastprintDLL();
    }

    
}